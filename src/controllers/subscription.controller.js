import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

//toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params

  if (!isValidObjectId(channelId)) {
    throw new apiError(400, "Invalid channel id")
  }

  const isSubscribed = await Subscription.findOneAndDelete({
    subscriber: req.user?._id,
    channel: channelId,
  })

  if (isSubscribed) {
    return res
      .status(200)
      .json(
        new apiResponse(200, { subscribed: false }, "unsubscribed successfully")
      )
  }

  await Subscription.create({
    subscriber: req.user?._id,
    channel: channelId,
  })

  return res
    .status(200)
    .json(
      new apiResponse(200, { subscribed: true }, " Subscribed Successfully")
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params
  if (!isValidObjectId(channelId)) {
    throw new apiError(400, "Invalid channel id")
  }

  const subscribers = await subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localfield: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "subscriber",
              as: "subscribersOfSubscriber",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribersOfSubscriber",
              },
              subscribedToSubscriber: {
                $cond: {
                  if: {
                    $in: [channelId, "$subscribersOfSubscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
        ],
      },
    },
    {
      //create separate document for each value in array
      $unwind: "$subscriber",
    },
    {
      $project: {
        subscriber: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          subscribedToSubscriber: 1,
          subscribersCount: 1,
        },
      },
    },
  ])

  return res
    .status(200)
    .json(new apiResponse(200, subscribers, "Subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params

  const subscribedchannels = await subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "Videos",
            },
          },
          {
            $addFields: {
              videosCount: {
                $size: "$videos",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribedChannel",
    },
    {
      $project: {
        _id: 0,
        subscribedChannel: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          videosCount: 1,
        },
      },
    },
  ])

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        subscribedchannels,
        "channel list fetched sucessfully"
      )
    )
})

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels }
