import "dotenv/config"
import connectDB from "./db/index.js"
import { app } from "./app.js"
const port = process.env.PORT || 8000
connectDB()
  .then(
    app.listen(port, () => {
      console.log(`server is listening on port ${port}`)
    })
  )
  .catch((err) => {
    console.log(`MONGODB connection failed ${err}`)
  })
