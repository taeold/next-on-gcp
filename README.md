# Next.js on GCP: The Hard Parts

This is a sample [Next.js](https://nextjs.org/) project to demonstrate to deploying a Next.js app on GCP with the following features:

- [x] Rendering server-side content with Cloud Run
- [x] Supporting incremental static regeneration (ISR) with Cloud Storage
- [ ] Supporting incremental static regeneration (ISR) with RTDB
- [ ] Serving static assets from Firebase Hosting
- [ ] Image optimization with IPX

## Deploying on GCP

First, build the docker container using the included Dockerfile:

```bash
docker build -t nextjs-on-gcp .
```

Then, deploy the container to Google Cloud Artifact Registry:

```bash
export MY_PROJECT_ID=...
docker tag nextjs-on-gcp us-central1-docker.pkg.dev/MY_PROJECT_ID/run/nextjs-on-gcp
docker push us-central1-docker.pkg.dev/MY_PROJECT_ID/run/nextjs-on-gcp
```

Finally, deploy the container to Cloud Run:

```bash
gcloud run deploy nextjs-on-gcp \
  --image us-central1-docker.pkg.dev/MY_PROJECT_ID/run/nextjs-on-gcp \
  --platform managed \
  --region us-central1 \
  --execution-environment gen2 \
  --allow-unauthenticated
```
