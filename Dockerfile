# --- Stage 1: Build the Rust Backend ---
FROM rust:1.85-slim AS builder

# Increase stack size and drastically limit jobs to save memory
ENV RUST_MIN_STACK=16777216
ENV CARGO_BUILD_JOBS=1
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy the entire backend source
COPY server-rs/ ./server-rs/

# Build the real binary with strict memory limits
# We force codegen-units to 1 and disable entirely any Link-Time Optimization via rustflags
ENV CARGO_PROFILE_RELEASE_LTO=false
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1
ENV RUSTFLAGS="-C lto=off -C opt-level=z -C debuginfo=0"
RUN cd server-rs && cargo build --target-dir /tmp/target --release

# --- Stage 2: Final Runtime Image (Ultra-lightweight) ---
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install a lightweight static file server
RUN npm install -g serve@14

# Copy assets and binary from builder
COPY --from=builder /tmp/target/release/server-rs /app/server-rs-bin
# Ensure it is executable
RUN chmod +x /app/server-rs-bin

COPY dist/ /app/dist/
COPY server-rs/data /app/data

# Use built-in 'node' user
RUN chown -R node:node /app

EXPOSE 5173
EXPOSE 8000
USER node
CMD ["sh", "-c", "/app/server-rs-bin & serve -s /app/dist -l 5173"]

