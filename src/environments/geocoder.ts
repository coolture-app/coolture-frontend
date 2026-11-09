/**
 * Where the place search goes. The same in every build: on AWS, CloudFront sends /geo to our Photon instance, and
 * locally ng serve's proxy (proxy.conf.json) sends it to the container `make up` starts in coolture-aws. It lives
 * apart from environment.ts because deploy.sh writes that file from scratch.
 */
export const geocoder = {
  url: '/geo',
  /** Poland first is a setting, not a limit: nothing stored assumes it. */
  countryCodes: ['PL'],
};
