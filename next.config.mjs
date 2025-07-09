/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * WebContainers (StackBlitz) need `SharedArrayBuffer`, which in turn requires
   * the page to be cross-origin isolated.  The two headers below enforce that.
   *
   * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
