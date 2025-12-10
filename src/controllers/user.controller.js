import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessandRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken   =  user.generateRefreshToken()


        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false} )
        return {accessToken ,refreshToken}

    } catch (error) {
        throw new ApiError(500,"something went wrong while generating tokens")
        
    }
}
const registerUser = asyncHandler( async (req, res) => {
    const {fullName,email,username,password} = req.body
    console.log("email:",email) 
    if (
        [fullName, email, password, username].some((field) => field?.trim() === "")){
            throw new ApiError(400 , "All fields are compulsory")
        }

       const existedUser = await User.findOne({
            $or : [{username}, {email}]
        })

        if(existedUser){
            throw new ApiError(409 ,"Username or email already exists")
        }

        const avatarLocalPath = req.files?.avatar [0]?.path
        // const CoverImageLocalPath = req.files?.coverImage[0]?.path

        let coverImageLocalPath;
         if(req.flies && Array.isArray(req.files.coverimage) && req.flies.coverImage.length >0){
            coverImageLocalPath =  req.flies.coverimage[0].path
         }

        if(!avatarLocalPath){
            throw new ApiError(400, 'Avatar file is required')
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)

        if(!avatar){
             throw new ApiError(400, 'Avatar file is required')
        }

        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url ,
            email,
            password,
            username : username.toLowerCase()
        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshtoken"
        )

        if(!createdUser){
            throw new ApiError(500,"something went wrong while registering")
        }

        return res.status(201).json(new ApiResponse (200, createdUser,"User registered successfully"))

})

const loginUser = asyncHandler(async(req,res) => {
const {email,username,password} = req.body
if(!username && !email){
    throw new ApiError(400,"Username or email is required")
}

const user = await User.findOne({
    $or : [{username},{email}]
})

if(!user){
    throw new ApiError(404,"user doesnt exist")
}


const isPasswordValid = await user.isPasswordCorrrect(password)

if(!isPasswordValid){
    throw new ApiError(401,"Password is invalid")
}


const {accessToken,refreshToken} = await generateAccessandRefreshToken(user._id)


const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

const options = {
    httpOnly : true,
    secure : true
}

return res.status(200).cookie("accessToken",accessToken,options)
.cookie("refreshToken",refreshToken,options)
.json(
    new ApiResponse(200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged In successfully"
    )
)
})

const logoutUser = asyncHandler(async (req,res ) => {
   await User.findByIdAndUpdate(req.user._id, {
    $set:{
        refreshToken : undefined
    }
   },
   {
        new : true
    })
   const options = {
    httpOnly : true,
    secure : true
}
   return res.status(200).clearCookie("accessToken",options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200,{},"User logged Out"))
})


export {registerUser , loginUser  ,logoutUser};