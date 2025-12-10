import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { json } from "express";




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
if(!username || !email){
    throw new ApiError(400,"Username or email is required")
}

const user = await User.findOne({
    $or : [{username},{email}]
})

if(!user){
    throw new ApiError(404,"user doesnt exist")
}


const isPasswordValid = await user.isPasswordcorrect(password)

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


const refreshAccessToken = asyncHandler (async(req,res)=> {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    try{
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.ACCESS_TOKEN_SECRET
    )
       const user = await User.findById(decodedToken?._id)

       if(!user){
        throw new ApiError(401,"invalid refresh token")
       }

       if(!incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401,"refresh token is expired or used")
       }
       const options = {
        httpOnly : true,
        secure : true
       }

       generateAccessandRefreshToken(user._id)

       return res 
       .status(200)
       .cookie("accessToken",accessToken,options)
       .cookie("refreshToken",newrefreshToken,options)
       .json(
        new ApiResponse (200,
            {accessToken, refreshToken: newrefreshToken},"Access token refreshed"
        )
       )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) =>
{
    const {oldPassword,newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordcorrect = await user.isPasswordcorrect(oldPassword)

    if(!isPasswordcorrect){
        throw new ApiError(400,"Invalid Password")
    }

    user.password = newPassword
    user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200 , {}, "Password changed")
    )
})

const getCurrentUser= asyncHandler(async (req,res)=>
{
    return res.status(200)
    .json(new ApiResponse(200, req.user, "curent user fetched successfully"))
})


const updateAccountDetails = asyncHandler (async (req, res )=>{
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")

    }

   const user =  await User.findByIdAndUpdate(
    req.user?._id,{
        $set :{
            fullName,email
        }
    }
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200,user,"account user details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res)=>
{
   const avaterLocalPath = req.file?.path
    
   if(!avaterLocalPath){
    throw new ApiError(400, "avatar file missing")

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")
    return res 
    .status(200)
    .json(new ApiResponse(200,user,"avatar uploaded successfully")
    )
   }
})

const updateUserCoverImage = asyncHandler(async (req,res)=>
{
   const avaterLocalPath = req.file?.path
    
   if(!coverImageLocalPath){
    throw new ApiError(400, "cover image file missing")

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res 
    .status(200)
    .json(new ApiResponse(200,user,"Coverimage uploaded successfully")
    )
   }
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
 const{username} = req.params

 if(!username?.trim()){
    throw new ApiError(400, "Username is missing")
 }

   const channel = await User.aggregate([
    {
        $match: {
            username: username?.toLowerCase()
        }
    }, 
    {
        $lookup: {
            from: "subscription",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup: {
            from: "subscription",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount:{
                $size : "$subscribers"
            },
            channelsSubscribedToCount:
            {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond:{
                    if: {$in : [req.user?._id,"$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project:{
            fullName:1,
            username:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            email:1,
            avatar:1,
            coverImage:1
        }
    }
   ])

   return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
   if(!channel?.length){
       throw new ApiError(404,"channel doest exist")
   
   }
   return res.status(200)
   .json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

export {    registerUser ,                     loginUser  ,
                    logoutUser , 
                    refreshAccessToken,
                    changeCurrentPassword,
                    getCurrentUser,
                    updateAccountDetails,
                    updateUserAvatar,
                    updateUserCoverImage    };