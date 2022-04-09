echo "Building client..."
cd ./client-vue
yarn run build
echo "Building server..."
cd ../server
yarn run build
yarn run start