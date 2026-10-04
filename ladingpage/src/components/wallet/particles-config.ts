/**
 * Cấu hình Particles SDK đọc từ env NEXT_PUBLIC_PARTICLE_* (được inlined lúc
 * build). File này cố tình KHÔNG import SDK để các module dùng chung (Navbar,
 * WalletCard khi degrade, ParticlesProvider) không kéo bundle authkit/antd về
 * những trang không dùng ví.
 */

export const PARTICLE_PROJECT_ID = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "";
export const PARTICLE_CLIENT_KEY = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "";
export const PARTICLE_APP_ID = process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "";
