# Next.js on GCP: The Hard Parts

This is a sample [Next.js](https://nextjs.org/) project to demonstrate how to deploy a Next.js app to GCP with the following features:

- [Traced output](https://cloud.google.com/trace/docs/trace-output) for [Cloud Trace](https://cloud.google.com/trace)


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
