import { Request, Response, NextFunction } from "express";

const allowedTokens = (process.env.STATIC_TOKENS || "").split(",");

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(" ")[1];
    console.log(token);
    if (!token) {
        res.status(403).json({ error: "No token provided." });
        return;
    }
    
    if (!allowedTokens.includes(token)) {
        res.status(403).json({ error: "Invalid token." });
        return;
    }

    next();
};

export default authenticate;
