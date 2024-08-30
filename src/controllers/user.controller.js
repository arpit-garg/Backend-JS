import { asyncHandler } from "../utils/asyncHandler.js"

const registerUser = asyncHandler((request, response) => {
  response.status(200).json({
    message: "ok",
  })
})

export { registerUser }
