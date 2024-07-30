import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"

const connectDB = async function connection(){
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`MONGODB connected at HOST: ${connectionInstance.connection.host}`)
    }
    catch(error){
        console.log("ERROR: could not connect to database",error);
        process.exit(1);
    }
}

export default connectDB