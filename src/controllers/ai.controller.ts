import { Response , Request } from "express";
import { ref , get , set } from "firebase/database";
import { database } from "../firebaseConfig";

export const generateResponse = async (req: Request, res: Response) => {
    console.log("Received request to /generate");
  const { prompt } = req.body;
  console.log("Received prompt:", prompt);

  try {
    const dbRef = ref(database , 'ai')
    const snapshot = await get(dbRef);
    let aiData = snapshot.val() || {};
    console.log("Current AI data in database:", aiData);
    await set(dbRef, { ...aiData, lastPrompt: prompt });
    console.log("Updated AI data in database:", { ...aiData, lastPrompt: prompt });
    res.status(200).json({ message: "Prompt received and stored successfully!" });
  } catch (error: any) {
    console.error("Error storing prompt in database:", error);
    res.status(500).json({ error: "An error occurred while processing the prompt." });
  
}
}
export const test = async (req: Request, res: Response) => {
    console.log("Received request to /test");
    res.status(200).json({ message: "Test endpoint is working!" });
}