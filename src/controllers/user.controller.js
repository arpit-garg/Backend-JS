import { asyncHandler } from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
const registerUser = asyncHandler(async (request, response) => {
  // get data from frontend
  //valiation - not empty
  //avatar is req - not empty
  //cover image
  //upload to cloudinary
  //correctly uploaded or not
  //db entry
  //select all feilds except password and refresh token
  // return that user
  const {
    body: { email, username, fullname, password },
  } = request
  if (
    [email, username, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are required")
  }
  const existedUser = User.findOne({
    $or: [{ username }, { email }],
  })

  if (existedUser) {
    throw new apiError(409, "Username or Email already exists!")
  }
  // console.log(request.files)
  // will use optional chaining in case files property is nor there or any file is not there
  const avatarLocalPath = request.files?.avatar[0]?.path
  if (!avatarLocalPath) throw new apiError(400, "Avatar field is necessary")
  const coverImageLocalPath = request.files?.coverImage[0]?.path

  const avatarCloudinaryres = await uploadOnCloudinary(avatarLocalPath)
  const coverImageCloudinaryres = await uploadOnCloudinary(coverImageLocalPath)
  // avatar is uploaded successfully?
  if (!avatarCloudinaryres) {
    // Handle the case where avatar is undefined
    throw new ApiError(
      400,
      "Avatar upload failed. Please check the file and try again."
    )
  } else if (avatarCloudinaryres.error) {
    // Handle the case where avatar has an error property
    throw new ApiError(
      500,
      "Cloudinary server error: " + avatarCloudinaryres.error.message
    )
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    fullname,
    avatar: avatarCloudinaryres.url,
    coverImage: coverImageCloudinaryres?.url || "",
  })

  const createdUser = await User.findById(user._id).select(
    "-paasword -refreshToken"
  )
  if (!createdUser) {
    throw new apiError(500, "server Side error: user can not be created")
  }
  response
    .status(200)
    .json(apiResponse(200, createdUser, "User created successfully"))
})

const generateAccessAndRefreshToken = async (userId) => {
  const user = await User.findById(userId)
  const accessToken = user.generateAccessToken()
  const refreshToken = user.generateRefreshToken()

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false }) // to avoid checks for all field of schema
  return { accessToken, refreshToken }
}
const loginUser = asyncHandler(async (req, res) => {
  // req->body->data
  //find user by username or email if not then error
  // match password is passowrd correct if not then error
  // generate access and refresh tokens
  // update refresh token in db
  //set and send cookie with access and refresh token
  // also send access and refresh token in json res
  const {
    body: { username, email, password },
  } = req
  if (!(username || email)) {
    throw new apiError(401, "Username or email must be provided")
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  })
  if (!user) {
    throw new apiError(404, "User does not exists")
  }

  const passwordValid = user.isPasswordCorrect(password)
  if (!passwordValid) {
    throw new apiError(401, "Invalid credentials")
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  )
  const updatedUser = User.findById(user._id).select("-password -refreshToken")

  //cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: true,
  }

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new apiResponse(
        200,
        {
          user: updatedUser,
          accessToken,
          refreshToken,
        },
        "User logged in Succesfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
  //we need to authenticate user by access token
  // it will be done by verifyJWt middleware
  //now we have user in req object

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  )

  const options = {
    httpOnly: true,
    secure: true,
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken
  try {
    const decoded = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decoded._id)
    if (!user) throw new apiError(401, "Invalid refresh token")

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    )
    // no need of save hook
    user.refreshToken = refreshToken
    user.save({ validateBeforeSave: false })

    const cookieOptions = {
      httpOnly: true,
      secure: true,
    }
    res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      )
  } catch (error) {
    throw new apiError(401, error?.message || "invalid refresh token")
  }
})

const updatePassword = asyncHandler(async (req, res) => {
  const {
    body: { oldPassword, newPassword },
  } = req

  const user = await User.findById(req.user?._id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword
  // we want to call pre save
  await user.save({ validateBeforeSave: false })

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, username } = req.body

  if (!fullName || !username) {
    throw new ApiError(400, "All fields are required")
  }

  const usernameexists = User.findOne({ username })
  if (usernameexists) throw new apiError(400, "username already exists")
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        username,
      },
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing")
  }

  //TODO: delete old image - assignment

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if (!avatar.url) {
    throw new ApiError(500, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing")
  }

  //TODO: delete old image - assignment

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage.url) {
    throw new ApiError(500, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
  //get channel name from url params
  const { username } = req.params

  if (!username?.trim()) throw new apiError(400, "Username is missing")

  //now use aggregation pipeline to get details
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions", // model name in mongodb
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "subscribedto",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ])

  //aggregation pipeline return array
  if (!channel?.length) {
    throw new apiError(404, "channel does not exist yet")
  }
  //channel[0] = first document in channel array
  return res
    .status(200)
    .json(
      new apiResponse(200, channel[0], "Channel details fetched successfully")
    )
})

const getwatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ])

  return res
    .status(200)
    .json(new apiResponse(200, user, "Watch history fetched sucessfully"))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updatePassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getwatchHistory,
}
