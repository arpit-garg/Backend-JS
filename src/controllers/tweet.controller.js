import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Like } from "../models/like.model.js"

// create tweet
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body
  if (!content) {
    throw new apiError(400, "Content is required")
  }

  const Tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  })

  if (!Tweet) {
    throw new apiError(500, "Tweet creation failed")
  }
  return res
    .status(200)
    .json(new apiResponse(200, Tweet, "Tweet created successfully"))
})
// get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params
  if (!isValidObjectId(userId)) throw new apiError(400, "Invalid User id")

  const user = await User.findById(userId)
  if (!user) throw new apiError(404, "User not found")

  const tweets = Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
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
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likedBy",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likedBy",
        },
        ownerDetails: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likedBy.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        ownerDetails: 1,
        likesCount: 1,
        createdAt: 1,
        isLiked: 1,
      },
    },
  ])
  return res
    .status(200)
    .json(new apiResponse(200, tweets, "User tweets Fetched successfully"))
})

// update tweet
const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params
  const { content } = req.body

  if (!isValidObjectId(tweetId)) throw new apiError(400, "Invalid tweet id")

  if (!content) throw new apiError(400, "content is required")

  const tweet = await Tweet.findById(tweetId)
  if (!tweet) throw new apiError(404, "Tweet does not exist")

  if (req.user?._id.toString() !== tweet.owner.toString())
    throw new apiError(401, "you are not authorised to make any changes")
  const newTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  )

  if (!newTweet) throw new apiError(500, "Updates to tweet failed")

  return res
    .status(200)
    .json(new apiResponse(200, newTweet, "Tweet updated sucessfully"))
})

// delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params
  if (!isValidObjectId(tweetId)) throw new apiError(400, "invalid tweet id")

  const tweet = await Tweet.findById(tweetId)
  if (!tweet) throw new apiError(404, "Tweet does not exist")

  if (req.user?._id.toString() !== tweet.owner.toString())
    throw new apiError(401, "you are not authorised to make any changes")

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId)
  if (!deletedTweet) throw new apiError(500, "error while deleting tweet")

  //delete likes
  await Like.deleteMany({
    tweet: tweetId,
  })

  return res
    .status(200)
    .json(new apiResponse(200, {}, "tweet deleted Successfully"))
})

export { createTweet, getUserTweets, updateTweet, deleteTweet }
