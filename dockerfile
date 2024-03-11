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

RUN chown -R latexuser:latexuser /app/


COPY package*.json /app/

RUN npm install

COPY dist/ /app/

# Switch to the non-root user

# USER latexuser

EXPOSE 8080

CMD ["node", "app.js"]