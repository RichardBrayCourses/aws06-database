#!/bin/sh
API_BASE_URL_PARAMETER="/services/api/base-url"
API_BASE_URL="${API_BASE_URL:-$(MSYS_NO_PATHCONV=1 aws ssm get-parameter --name "$API_BASE_URL_PARAMETER" --query "Parameter.Value" --output text)}"
API_BASE_URL="${API_BASE_URL%/}"
PHOTOS_DIR="../../photos-to-upload"

if [ -z "$COGNITO_ID_TOKEN" ]; then
  echo "COGNITO_ID_TOKEN is required for protected API calls."
  exit 1
fi

curl -sf -X DELETE "$API_BASE_URL/auth/admin/photos" \
  -H "Authorization: $COGNITO_ID_TOKEN"
echo ""

for photo in "$PHOTOS_DIR"/*; do
  photo_name="$(basename "$photo")"
  image_name="${photo_name%.*}"
  upload_url=$(curl -sf -X POST "$API_BASE_URL/auth/photos/presigned-url" \
    -H "Authorization: $COGNITO_ID_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"imageName\":\"$image_name\",\"imageDescription\":\"Uploaded by the bulk image script\",\"contentType\":\"image/jpeg\"}" \
    | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => console.log(JSON.parse(body).uploadUrl));")

  if [ -z "$upload_url" ]; then
    echo "Could not get upload URL from $API_BASE_URL/auth/photos/presigned-url"
    exit 1
  fi

  curl -sf -X PUT "$upload_url" \
    -H "Content-Type: image/jpeg" \
    --data-binary @"$photo"
done

photos_response=$(curl -sf "$API_BASE_URL/public/gallery-photos")
photo_count=$(printf "%s" "$photos_response" | grep -o '"id"' | wc -l | tr -d ' ')

echo "Gallery now contains $photo_count photos."
