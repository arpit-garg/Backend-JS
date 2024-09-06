import { asyncHandler } from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { apiResponse } from "../utils/apiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"
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

export { registerUser, loginUser, logoutUser, refreshAccessToken }
