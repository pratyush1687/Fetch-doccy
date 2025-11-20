# Enterprise Experience Showcase

This document provides examples from experience building and operating distributed systems at scale.

## Similar Distributed System

**Question:** Provide a brief example (1-2 paragraphs) of a similar distributed system you've built and its scale/impact.

---

I architected and built Filterpixel, an event-based microservice system designed for large-scale image processing. The system was built to handle millions of images through a write-heavy workload, processing over 5 million images in production every year. The architecture leveraged asynchronous event processing with multiple microservices handling different stages of the image processing pipeline, enabling horizontal scaling and fault tolerance.

The system achieved significant performance improvements, reducing processing time from 12 minutes to 4 minutes for batches of 1000 images—a 66% reduction in latency. This dramatic improvement in throughput directly enhanced the customer experience, increasing the "AHA factor" and significantly improving customer retention rates. The event-driven architecture allowed the system to handle variable loads efficiently while maintaining reliability and scalability.

---

## Performance Optimization

**Question:** Provide a brief example (1-2 paragraphs) of a performance optimization that resulted in significant improvements.

---

I implemented a comprehensive optimization strategy that significantly improved both latency and infrastructure costs for our ML inference workloads. The optimization involved two key changes: implementing staged builds in Dockerfiles to reduce image sizes and startup times, and converting our production models from TensorFlow/Python to ONNX format with ONNX Runtime for inference. ONNX Runtime proved to be a much lighter package compared to TensorFlow or full Python ML stacks, resulting in faster container startup times and reduced memory footprint.

The conversion to ONNX Runtime delivered substantial performance improvements, reducing inference latency while cutting infrastructure costs. Additionally, ONNX Runtime's architecture provided the flexibility to leverage platform-specific optimizations, such as OpenVINO for Intel-based servers, which further accelerated inference speed. This optimization demonstrated how choosing the right runtime and model format can dramatically improve both performance and cost efficiency in production ML systems, while maintaining model accuracy and enabling hardware-specific optimizations.

---

## Critical Production Incident

**Question:** Provide a brief example (1-2 paragraphs) of a critical production incident you resolved in a distributed system.

---

A few months ago, we experienced a critical production outage when MongoDB Atlas suffered a complete service failure, rendering our entire user authentication and data retrieval system inoperable. Users were unable to log in or fetch their account details, and even MongoDB's own backup systems were unavailable, leaving us without access to our primary database or its managed backups. This incident highlighted the critical importance of having independent backup strategies beyond relying solely on cloud provider services.

Fortunately, I had implemented a scheduled daily backup process that ran at 6 PM on a local machine, storing user data independently of the cloud provider. Using this backup, I was able to quickly spin up a new MongoDB instance and migrate the data, restoring service for the majority of users. While we lost data consistency for the last 24 hours of user activity—a trade-off we had to accept to restore service quickly—we successfully brought the system back online and prevented a prolonged outage. This incident reinforced the importance of multi-layered backup strategies and having recovery procedures that don't depend on a single point of failure.

---

## Architectural Decision

**Question:** Provide a brief example (1-2 paragraphs) of an architectural decision you made that balanced competing concerns.

---

When faced with escalating infrastructure costs and scalability challenges in our image processing system, I needed to make an architectural decision that balanced cost efficiency, performance, reliability, and development complexity. The system was running on GCP Cloud Run with images embedded directly in message payloads, which was causing cost overruns ($5,000/month), payload size limitations, and processing bottlenecks. I conducted multiple experiments testing different approaches: comparing serverless vs. containerized architectures, evaluating message queue payload strategies, and benchmarking various storage solutions.

Through systematic experimentation, I determined that migrating to AWS Lambda with SNS queues and using S3 as a separate storage layer would best address our competing concerns. This decision required trading some architectural simplicity (decoupling storage from messaging) for significant cost reduction (80% savings), improved scalability, and better fault tolerance. The architecture balanced the need for cost efficiency against operational complexity, ultimately reducing monthly costs from $5,000 to $1,000 while improving system stability and latency. The experimental approach allowed me to validate the trade-offs before committing to the migration, ensuring the decision was data-driven rather than based on assumptions.

---

