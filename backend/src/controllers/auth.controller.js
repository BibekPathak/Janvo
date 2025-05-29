import { upsertStreamUser } from '../lib/stream.js';
import User from '../models/user.js';
import jwt from 'jsonwebtoken';

export async function signup(req, res) {
    const {email, password, fullName} = req.body;

    try {
        if (!email || !password || !fullName) {
            return res.status(400).json({message: 'All fields are required'});
        }

        if (password.length < 6) {
            return res.status(400).json({message: 'Password must be at least 6 characters long'});
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({message: 'Invalid email format'});
        }
        
        const existingUser = await User.findOne({email});
        if (existingUser) {
            return res.status(400).json({message: 'Email already exists'});
        }

        const idx= Math.floor(Math.random() * 100)+ 1;
        const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

        const newUser = await User.create({
            fullName,
            email,
            password,
            profilePic: randomAvatar
        });

        try {
            await upsertStreamUser({
                id: newUser._id.toString(),
                name: newUser.fullName,
                image: newUser.profilePic || ''
            });
            console.log(`Stream user created successfully for this user ${newUser.fullName}`);
        } catch (error) {
            console.error('Error upserting Stream user:', error);
        }

        const token= jwt.sign(
            {userId: newUser._id},
            process.env.JWT_SECRET_KEY,
            {expiresIn: '7d'}
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({success: true, user: newUser});
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({message: 'Internal server error'});
    }
}

export async function login(req, res) {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({message: 'Email and password are required'});
        }

        const user = await User.findOne({email});
        if (!user) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const token = jwt.sign(
            {userId: user._id},
            process.env.JWT_SECRET_KEY,
            {expiresIn: '7d'}
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(200).json({success: true, user});
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({message: 'Internal server error'});
    }
}

export async function logout(req, res) {
    res.clearCookie('token');
    res.status(200).json({success: true, message: 'Logged out successfully'});
}

export async function onboard(req, res){
    try {
        const userId= req.user._id;
        
        const {fullName, bio, nativeLanguage, learningLanguage, location} = req.body;
        if (!fullName || !bio || !nativeLanguage || !learningLanguage || !location) {
            return res.status(400).json({
                message: 'All fields are required',
                missingFields: [
                    !fullName && 'fullName',
                    !bio && 'bio',
                    !nativeLanguage && 'nativeLanguage',
                    !learningLanguage && 'learningLanguage',
                    !location && 'location'
                ].filter(Boolean) // Filter out undefined values
            });
        }

        const updateUser = await User.findByIdAndUpdate(
            userId,
            {
                ...req.body,
                isOnboarded: true
            },
            {new: true}
        );

        if (!updateUser) {
            return res.status(404).json({message: 'User not found'});
        }

        try {
            await upsertStreamUser({
                id: updateUser._id.toString(),
                name: updateUser.fullName,
                image: updateUser.profilePic || ''
            });
            console.log(`Stream user updated successfully for this user ${updateUser.fullName}`);
        } catch (error) {
            console.error('Error upserting Stream user during onboarding:', error);
        }
        
        res.status(200).json({success: true, user: updateUser});
    } catch (error) {
        console.error('Onboard error:', error);
        res.status(500).json({message: 'Internal server error'});
    }
}