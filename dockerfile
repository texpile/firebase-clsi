FROM node:18.10.0-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update
RUN apt-get install -y texlive-latex-recommended
RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir /app/temp

COPY package*.json /app/

RUN npm install

COPY dist/ /app/

EXPOSE 8080

CMD ["node", "app.js"]
