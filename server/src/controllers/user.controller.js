import asyncHandler from "../utils/asyncHandler.js"
import ApiError from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary, deleteOnCloudinary} from "../utils/cloudinary.js"
import ApiResponse from "../utils/ApiResponse.js"
import JWT from "jsonwebtoken"
import mongoose from 'mongoose'

const generateAccessAndRefreshToken = async(userId) => {
    
    try {
        const user = await User.findById(userId);
        
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token.");
    }
};

const registerUser = asyncHandler( async(req, res) => {
    // get user details from frontend
    // validation - not empty etc...
    // check if user already exists: username, email
    // check for images, avatar
    // upload to cloudinary, avatar check
    // create user object - create entry in db
    // remove password and refresh token from response
    // check for user creation
    // return response

    const {username, email, fullName, password} = req.body

    if ([username, email, fullName, password].some(
        (field) => ( field?.trim() === "" )
    )) {
        throw new ApiError(400, "All fields are required")
    }

    const userExists = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (userExists) throw new ApiError(409, "user with username or email already exists")

    // console.log("req.files", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path
    // console.log("avatarLocalPath", avatarLocalPath);

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required")

    const avatar = await uploadOnCloudinary(avatarLocalPath).catch((error) => console.log(error))
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // console.log(avatar);null
    if (!avatar) throw new ApiError(400, "Avatar file is required!!!.")

    const user = await User.create({
        fullName,
        avatar: {
            public_id: avatar.public_id,
            url: avatar.secure_url
        },
        coverImage: {
            public_id: coverImage?.public_id || "",
            url: coverImage?.secure_url || ""
        },
        username: username.toLowerCase(),
        email,
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) throw new ApiError(500, "user registration failed, please try again")

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )

});

const loginUser = asyncHandler(async(req, res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send tokens in cookies

    const {email, username, password} = req.body;

    if (!(username || email)) {
        throw new ApiError(400, "username or email is required.");
    }

    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (!user) {
        throw new ApiError(404, "User doesnot exist.");
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid user credentials.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(" -password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "None"
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully !!!."
            )
        );

});

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // removes field from document
            }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "None"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logout successfull !!!."
            )
        );
});

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    const user = await User.findOne({
        refreshToken: incomingRefreshToken
    });

    if (!user) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken , refreshToken } = await generateAccessAndRefreshToken(user._id);

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "None"
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken
                },
                "Access token refreshed"
            )
        )

});

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isOldPasswordCorrect = await user.comparePassword(oldPassword);

    if (!isOldPasswordCorrect) {
        throw new ApiError(400, "Incorrect old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Password updated successfully")
        )
});

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "current user fetched successfully")
        )
});

const updateUserDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        )
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.findById(req.user._id).select("avatar");

    const avatarToDelete = user.avatar.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: {
                    public_id: avatar.public_id,
                    url: avatar.secure_url
                }
            }
        },
        { new: true }
    ).select("-password");

    if (avatarToDelete && updatedUser.avatar.public_id) {
        await deleteOnCloudinary(avatarToDelete);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedUser, "Avatar update successfull")
        )
});

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading coverImage");
    }

    const user = await User.findById(req.user._id).select("coverImage");

    const coverImageToDelete = user.coverImage.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: {
                    public_id: coverImage.public_id,
                    url: coverImage.secure_url
                }
            }
        },
        { new: true }
    ).select("-password");

    if (coverImageToDelete && updatedUser.coverImage.public_id) {
        await deleteOnCloudinary(coverImageToDelete);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedUser, "coverImage update successfull")
        )
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions", // The collection to join with
                localField: "_id", // Field from the current collection (User) to match
                foreignField: "channel", // Field from the 'subscriptions' collection to match
                as: "subscribers" // Alias for the joined data
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subcribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subcribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ]);

    // console.log(channel);
    if (!channel?.length) {
        throw new ApiError(404, "channel doesnot exist");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "User channel fetced successfully"
            )
        )
});

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully"
            )
        )
});



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}


/*

This file code is doing the following:

**It's a user controller file**

This file contains functions that handle user-related operations, such as updating user details, changing passwords, and fetching user data.

**Here's what it does:**

1. **Updates user details**: It updates a user's details, such as their full name and email address.
2. **Changes passwords**: It changes a user's password.
3. **Fetches user data**: It fetches a user's data, such as their profile information.

**In simple words**, this code is like a manager that helps users manage their own accounts. It allows users to update their information, change their passwords, and view their own data.

**The use of it in this project**:

This user controller file is used in the project to provide a way for users to manage their own accounts. It's used in conjunction with the authentication middleware to ensure that only authorized users can access and modify their own data.

For example, when a user wants to update their profile information, the client-side application sends a request to the server, which then uses this user controller file to update the user's details in the database.

Similarly, when a user wants to change their password, the client-side application sends a request to the server, which then uses this user controller file to update the user's password in the database.

Overall, this user controller file plays a crucial role in managing user data and ensuring that users can securely access and modify their own accounts.

*/

/*

Here is a detailed, step-by-step explanation of what the user controller file does:

**Step 1: Update User Details**

* The client-side application sends a request to the server to update the user's details.
* The request includes the updated details, such as the user's full name and email address.
* The server receives the request and uses the user controller file to update the user's details in the database.
* The user controller file uses the `updateUserDetails` function to update the user's details.
* The `updateUserDetails` function takes the updated details as input and updates the corresponding fields in the user's document in the database.

**Step 2: Change Password**

* The client-side application sends a request to the server to change the user's password.
* The request includes the new password and the user's current password.
* The server receives the request and uses the user controller file to change the user's password in the database.
* The user controller file uses the `changePassword` function to change the user's password.
* The `changePassword` function takes the new password and the user's current password as input and updates the user's password in the database.

**Step 3: Fetch User Data**

* The client-side application sends a request to the server to fetch the user's data.
* The request includes the user's ID or other identifying information.
* The server receives the request and uses the user controller file to fetch the user's data from the database.
* The user controller file uses the `getUserData` function to fetch the user's data.
* The `getUserData` function takes the user's ID or other identifying information as input and retrieves the corresponding user document from the database.

**Step 4: Return User Data**

* The user controller file returns the user's data to the client-side application.
* The client-side application receives the user's data and displays it to the user.

Here is a more detailed example of how the user controller file works:

**Example: Update User Details**

* The client-side application sends a request to the server to update the user's details:
```json
{
  "userId": "12345",
  "fullName": "John Doe",
  "email": "johndoe@example.com"
}
```
* The server receives the request and uses the user controller file to update the user's details in the database.
* The user controller file uses the `updateUserDetails` function to update the user's details:
```javascript
const updateUserDetails = async (req, res) => {
  const userId = req.body.userId;
  const fullName = req.body.fullName;
  const email = req.body.email;

  const user = await User.findById(userId);
  user.fullName = fullName;
  user.email = email;
  await user.save();

  res.json({ message: "User details updated successfully" });
};
```
* The `updateUserDetails` function updates the user's details in the database and returns a success message to the client-side application.

I hope this helps! Let me know if you have any questions or need further clarification.

*/