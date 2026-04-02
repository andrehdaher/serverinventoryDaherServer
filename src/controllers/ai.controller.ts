import { Response , Request } from "express";
import { ref , get , set } from "firebase/database";
import { database } from "../firebaseConfig";

export const generateResponse = async (req: Request, res: Response) => {
    console.log("Received request to /generate");
  const { prompt } = req.body;
  console.log("Received prompt:", prompt);
}

export const test = async (req: Request, res: Response) => {
    console.log("Received request to /test");
    res.json({ message: "Test endpoint is working!" });
}