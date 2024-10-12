import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

//toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "INvalid video id")
  }

  const liked = await Like.findOne({
    video: videoId,
    likedBy: req.user?._id,
  })

  if (liked) {
    await Like.findByIdAndDelete(liked._id)

    return res
      .status(200)
      .json(
        new apiResponse(200, { isLiked: false }, "Like deleted from video ")
      )
  }

  await Like.create({
    video: videoId,
    likedBy: req.user?._id,
  })

  return res
    .status(200)
    .json(new apiResponse(200, { isLiked: true }, "Like added to video"))
})
//toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params
  if (!isValidObjectId(commentId)) {
    throw new apiError(400, "Invalid comment id")
  }

  const liked = await Like.findOne({
    comment: commentId,
    likedBy: req.user?._id,
  })

  if (liked) {
    await Like.findByIdAndDelete(liked._id)

    return res
      .status(200)
      .json(
        new apiResponse(200, { isLiked: false }, "Like deleted from comment ")
      )
  }

  await Like.create({
    comment: commentId,
    likedBy: req.user?._id,
  })

  return res
    .status(200)
    .json(new apiResponse(200, { isLiked: true }, "Like added to comment"))
})
//toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params
  if (!isValidObjectId(tweetId)) {
    throw new apiError(400, "INvalid tweet id")
  }

  const liked = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?._id,
  })

  if (liked) {
    await Like.findByIdAndDelete(liked._id)

    return res
      .status(200)
      .json(
        new apiResponse(200, { isLiked: false }, "Like deleted from tweet ")
      )
  }

  await Like.create({
    tweet: tweetId,
    likedBy: req.user?._id,
  })

  return res
    .status(200)
    .json(new apiResponse(200, { isLiked: true }, "Like added to tweet"))
})
//get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {
  const videos = Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
          },
          {
            $unwind: "$owner", // to take onwer out of array
          },
        ],
      },
    },
    {
      $unwind: "$video", //again to take out of array
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 0,
        video: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          owner: 1,
          title: 1,
          description: 1,
          views: 1,
          duration: 1,
          createdAt: 1,
          isPublic: 1,
          ownerDetails: {
            username: 1,
            fullName: 1,
            "avatar.url": 1,
          },
        },
      },
    },
  ])

  return res
    .status(200)
    .json(new apiResponse(200, videos, "Liked Videos fetched successfully"))
})

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos }
