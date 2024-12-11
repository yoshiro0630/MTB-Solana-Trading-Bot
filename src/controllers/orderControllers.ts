import { Request, Response } from "express";
import Order from "../models/Order";

export const addOrder = async (req: Request, res: Response) => {
    console.log("addOrder request==============>", req.body);
    const { userId, privKey, tokenAddress, limitAmount, marketCapToHit, mode } = req.body;

    try {
        const newOrder = new Order({
            userId,
            privKey,
            tokenAddress,
            limitAmount,
            marketCapToHit,
            mode
        });

        await newOrder.save();
        res.status(200).json({ message: "Order saved successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error saving order" });
    }
};

export const removeOrder = async (req: Request, res: Response) => { };