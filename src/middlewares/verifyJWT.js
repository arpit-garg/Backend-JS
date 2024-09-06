import { apiError } from "../utils/apiError"
import { asyncHandler } from "../utils/asyncHandler"
import { User } from "../models/user.model"
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookie?.accessToken ||
      req.header("authorization")?.replace("Bearer ", "")

    if (!token) {
      throw new apiError(401, "Unauthorized request")
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    // this decoded will have all fields which we define during generating accesstoken in user model
    const user = await User.findById(decoded?._id).select(
      "-password -refreshToken"
    )

    if (!user) throw new apiError(401, "invalid access token")

    //add dynamic property to req object for next middleware access
    req.user = user
    next()
  } catch (error) {
    throw new apiError(401, error?.message || "invalid access token")
  }
})
