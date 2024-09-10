import { Router } from "express"
import {
  getCurrentUser,
  getUserChannelProfile,
  getwatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updatePassword,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.js"
import { verifyJWT } from "../middlewares/verifyJWT.js"
const router = Router()

router.route("/register").post(
  upload.fields([
    //will add fields property to request object along with request.body for text fields
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
)

router.route("/login").post(loginUser)
//secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.post("/refresh-token", refreshAccessToken)
router.route("/update-password").post(verifyJWT, updatePassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/upadte-account").patch(verifyJWT, updateAccountDetails)
router
  .route("/upadte-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router
  .route("/upadte-coverImage")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getwatchHistory)

export default router
