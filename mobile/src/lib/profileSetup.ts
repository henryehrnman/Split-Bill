import {RpcError} from './http.ts';

// A previous creation may have committed even though its response never reached this device.
// Recover the authenticated profile by reading it; never automatically retry the write.
export async function finishProfile<T>(create: () => Promise<T>, fetchProfile: () => Promise<T>): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (!(error instanceof RpcError) || error.code !== 'has_profile') throw error;
    return fetchProfile();
  }
}
