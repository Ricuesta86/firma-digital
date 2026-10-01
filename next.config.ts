import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "nodemailer",
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;