import { Router } from "express"
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
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

export default router
