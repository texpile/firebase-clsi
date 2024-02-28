FROM node:18.10.0-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y texlive-full && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m latexuser

WORKDIR /app

RUN mkdir /app/temp

COPY package*.json /app/

RUN npm install

COPY dist/ /app/

# Switch to the non-root user

RUN chown -R latexuser:latexuser /app/
USER latexuser

EXPOSE 8080

CMD ["node", "app.js"]