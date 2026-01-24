# Custom Lavalink image with udev support
FROM ghcr.io/lavalink-devs/lavalink:4-alpine

# Switch to root to install packages
USER root

# Install eudev (Alpine's udev implementation) and other useful packages
RUN apk add --no-cache \
    eudev \
    eudev-libs

# Switch back to lavalink user
USER lavalink

# The rest is inherited from the base image
