FROM node:5.5.0
RUN apt-get update && apt-get install -y ruby-full && gem install scss_lint
COPY . /code
WORKDIR /code
RUN MINIFY=1 make
CMD ["bin/host"]
