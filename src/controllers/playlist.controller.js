import mongoose, { isValidObjectId, mongo } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { use } from "bcrypt/promises.js"

//create playlist
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body

  if (!name) {
    throw new apiError(400, "Name of playlist is required")
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  })

  if (!playlist) {
    throw new apiError(500, " Error occure while creating playlist")
  }

  return res
    .status(200)
    .json(new apiResponse(200, playlist, "playlist created successfully"))
})
//get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params

  if (!isValidObjectId(userId)) {
    throw new apiError(400, "invalid user id")
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: {
              ispublic: true,
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        NoOfVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        NoOfVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
          owner: 1,
        },
      },
    },
  ])

  return res
    .status(200)
    .json(new apiResponse(200, playlist, "playlists fetched successfully"))
})

//get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, " invalid playlist id")
  }

  const playlist = playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $match: {
        "videos.isPublic": true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
      },
    },
  ])

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlistVideos[0], "playlist fetched successfully")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, " invalid playlist id")
  }
  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "invalid  video id")
  }

  const playlist = await Playlist.findById(playlistId)
  const video = await Video.findById(videoId)

  if (!playlist) throw new apiError(404, "playlist not found")

  if (!video) throw new apiError(404, "video not found")

  if (
    playlist.owner.toString() !== req.user?._id.toString() &&
    video.owner.toString() !== req.user?._id.toString()
  ) {
    throw new apiError(401, "you don't have access to update the playlist")
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist._id,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  )

  if (!updatedPlaylist)
    throw new apiError(500, "video could not be added to playlist try again!!")
  return res
    .status(200)
    .json(new apiResponse(200, updatedPlaylist, "Video added to playlist "))
})
//remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, " invalid playlist id")
  }
  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "invalid  video id")
  }

  const playlist = await Playlist.findById(playlistId)
  const video = await Video.findById(videoId)

  if (!playlist) throw new apiError(404, "playlist not found")

  if (!video) throw new apiError(404, "video not found")

  if (
    playlist.owner.toString() !== req.user?._id.toString() &&
    video.owner.toString() !== req.user?._id.toString()
  ) {
    throw new apiError(401, "you don't have access to update the playlist")
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist._id,
    {
      $pull: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  )

  if (!updatedPlaylist)
    throw new apiError(500, "Error while deleting video from playlist")

  return res
    .status(200)
    .json(new apiResponse(200, updatedPlaylist, "video removed from playlist"))
})
// delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, " invalid playlist id")
  }
  const playlist = await Playlist.findById(playlistId)

  if (!playlist) throw new apiError(404, "playlist not found")

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(401, "you don't have access to delete the playlist")
  }

  await Playlist.findByIdAndDelete(playlist._id)

  return res
    .status(204)
    .json(new apiResponse(204, {}, "video deleted Successfully"))
})
// update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params
  const { name, description } = req.body

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, " invalid playlist id")
  }
  const playlist = await Playlist.findById(playlistId)

  if (!playlist) throw new apiError(404, "playlist not found")

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new apiError(401, "you don't have access to delete the playlist")
  }

  if (!name) {
    throw new apiError(400, "Name of playlist is required")
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist._id,
    {
      $set: { name, description },
    },
    {
      new: true,
    }
  )

  if (!updatedPlaylist) {
    throw new apiError(500, " Error occure while creating playlist")
  }

  return res
    .status(200)
    .json(
      new apiResponse(200, updatedPlaylist, "playlist updated successfully")
    )
})

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
}
