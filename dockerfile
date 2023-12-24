FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y texlive-latex-recommended nodejs npm

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY dist/ /app/

EXPOSE 3000

CMD ["node", "app.js"]
