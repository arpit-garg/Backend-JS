import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js"
import { upload } from "../middlewares/multer.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import { Playlist } from "../models/playlist.model.js"

//get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
  //When using object destructuring with default values, the default values
  // are only applied if the corresponding properties are not present in the
  //  object or if their values are undefined.
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
  // created search index by name of search-index in mongodb atlas on videos collection with field mapping of title and description
  const pipeline = []

  // because search stage should be first in aggregation pipeline
  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos", // if omitted it defaults to default,
        text: {
          query: query,
          path: [title, description],
        },
      },
    })
  }

  if (userId) {
    if (!isValidObjectId(userId)) throw new apiError(404, "Invalid User id")
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    })
  }
  // fetch videos only that are set isPublished as true
  pipeline.push({ $match: { isPublic: true } })

  // sort can be based on views,duration,createdAt
  // can sort in ascending order(1) or descending order(-1)
  if (sortBy) {
    pipeline.push({
      $sort: {
        [sortBy]: (sortType || "desc") === "asc" ? 1 : -1, //computed property names in ES6
      },
    })
  } else {
    pipeline.push({
      $sort: {
        score: { $meta: "searchScore", order: -1 },
      },
    })
  }
  //get video owner details
  pipeline.push({
    $lookup: {
      from: "users",
      localfield: "owner",
      foreignfield: "_id",
      as: "owner",
      pipeline: [
        {
          $project: {
            username: 1,
            "avatar.url": 1,
          },
        },
        {
          $first: "$owner",
        },
      ],
    },
  })

  //get the aggregate to pass to aggregate paginate
  // Now all you need to do is construct your aggregate without executing it like so, this means no await keyword or then blocks:
  const aggregate = Video.aggregate(pipeline)
  //paginate the results
  const video = await Video.aggregatePaginate(aggregate, {
    page: parseInt(page),
    limit: parseInt(limit),
  })
  //return response
  res
    .status(200)
    .json(new apiResponse(200, video, "Videos Fetched successfully"))
})

// get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body
  if ({ title, description }.some((field) => field?.trim() === "")) {
    throw new apiError(400, "title and description both should be present")
  }

  const videoFilePath = req.files?.videoFile
  const thumbnailpath = req.files?.thumbnail

  if (!videoFilePath) {
    throw new apiError(400, "You can't upload a video without a video")
  }
  if (!thumbnailpath) {
    throw new apiError(400, "Thumbnail is required for uploading video")
  }

  const videoFile = await uploadOnCloudinary(videoFilePath)
  const thumbnail = await uploadOnCloudinary(thumbnailpath)

  if (!videoFile)
    throw new apiError(500, "Video could not be uploaded to cloudinary")
  if (!thumbnail)
    throw new apiError(500, "thumbnail could not be uploaded to cloudinary")

  const video = await Video.create({
    title,
    description,
    owner: req.user?._id,
    duration: videoFile.duration,
    VideoFile: {
      public_id: videoFile.public_id,
      url: videoFile.url,
    },
    thumbnail: {
      public_id: thumbnail.public_id,
      url: thumbnail.url,
    },
  })

  const videoUploaded = await Video.findById(video._id)
  if (!videoUploaded) {
    throw new apiError(500, "error occured while storing in mongodb atlas")
  }

  return res
    .status(200)
    .json(new apiResponse(200, video, "video uploaded successfully"))
})

//get video by id
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!isValidObjectId(videoId)) throw new apiError(400, "invalid Video id")

  const video = await Video.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscribers",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  //if-then-else
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
            project: {
              username: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likes: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ])

  if (!video) {
    throw new apiError(404, "Video Fetching Failed")
  }

  // increment views if video fetched sucessfully
  await Video.findByIdAndUpdate(video._id, {
    $inc: {
      views: 1,
    },
  })

  // add to watch history of user if not already added
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: video._id,
    },
  })

  return res
    .statuts(200)
    .json(new apiResponse(200, video, "Video fetched Successfully"))
})

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!isValidObjectId(videoId)) throw new apiError(400, "invalid video id")
  const video = await Video.findById(videoId)
  const {
    body: { title = video.title, description = video.description },
  } = req
  const thumbnailLocalPath = req.file?.path || ""

  const thumbnailPublicIdToDelete = video.thumbnail.public_id

  //id1.equals(id2) or id1.toString()===id2.toString() or in mongoose id1 == ("8932479d7j37jshkhskgw" )this can only be string
  if (req.user?._id.toString() !== video.owner.toString()) {
    throw new apiError(401, "UnAuthorised to update video details")
  }

  let thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
  if (thumbnail) {
    deleteFromCloudinary(thumbnailPublicIdToDelete)
  } else {
    thumbnail = video.thumbnail
  }

  const videoUpdated = await Video.findByIdAndUpdate(
    videoId,
    {
      title,
      description,
      thumbnail: {
        url: thumbnail.url,
        public_id: thumbnail.public_id,
      },
    },
    { new: true }
  )

  return res
    .status(200)
    .json(
      new apiResponse(200, videoUpdated, "Video details updated successfully")
    )
})
// delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!isValidObjectId(videoId)) throw new apiError(400, "invalid Video id")

  const video = await Video.findById(videoId)
  if (!video) throw new apiError(404, "Video with this id does not exist")

  if (req.user?._id.toString() !== video.owner.toString()) {
    throw new apiError(401, "Unauthorised to delete video")
  }
  //video - likes - comments - playlist of that video delete
  const deletedVideo = await Video.findByIdAndDelete(video._id)
  if (!deletedVideo) {
    throw new apiError(500, "Video deletion failed")
  }

  await deleteFromCloudinary(deletedVideo.thumbnail.public_id) // by defaultresource type is image
  await deleteFromCloudinary(deletedVideo.videoFile.public_id, "video") // in destroy method specify resource type

  //delete video likes
  await Like.deleteMany({
    video: videoId,
  })
  //delete video comments
  await Comment.deleteMany({
    video: videoId,
  })

  //remove the video from playlist
  // To delete an element from an array field in a MongoDB document using JavaScript,
  // you can use the $pull operator. The $pull operator removes all instances of a value
  // or values that match a specified condition from an array.
  // const update = {
  //   $pull: { arrayField: { fieldToMatch: "valueToRemove" } }
  // };
  const update = {
    $pull: { videos: videoId },
  }
  Playlist.updateMany({}, update) //filter,update or update pipeline it can be pipeline also
  return res
    .status(200)
    .json(new apiResponse(200, {}, "video deleted Successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!isValidObjectId(videoId)) throw new apiError(400, "Invalid Video id")
  const video = await Video.findById(videoId)
  if (!video) throw new apiError(404, "Video could not be found")
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      401,
      "You can't toogle publish status as you are not the owner"
    )
  }
  const toggledVideoPublish = Video.findByIdAndUpdate(
    videoId,
    {
      //   $set: {
      //     isPublished: !video?.isPublished
      // }
      $set: {
        isPublic: {
          $cond: {
            if: { $eq: ["$isPublic", true] },
            then: false,
            else: true,
          },
        },
      },
    },
    { new: true }
  )

  if (!toggledVideoPublish) {
    throw new ApiError(500, "Failed to toogle video publish status")
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggledVideoPublish.isPublished },
        "Video publish toggled successfully"
      )
    )
})

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
}
