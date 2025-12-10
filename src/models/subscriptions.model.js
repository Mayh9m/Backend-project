import mongoose, {Schema} from "mongoose";


const subscriptionSchema = new Schema({
subscriber: {
    type : Schema.Types.ObjectId, //subscribing
    ref : "Users"

},
channel: {
    type : Schema.Types.ObjectId, //the channel to which user is subscribing
    ref : "Users",
    
}

},{timestamps: true})


export const Subscription = mongoose.model("Subscription",subscriptionSchema)