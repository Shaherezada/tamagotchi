#!/bin/sh
# Бакет для иконок и картинок форм с публичным чтением (методичка iu5git/Web, tutorials/silo:
# Create Bucket и Access Policy). В образе pgsty/silo нет mcli, поэтому – запросы S3 через curl с SigV4.
set -eu

auth="aws:amz:us-east-1:s3"
creds="$SILO_ACCESS_KEY:$SILO_SECRET_KEY"
bucket_url="$SILO_ENDPOINT/$SILO_BUCKET"

code=$(curl -s -o /dev/null -w '%{http_code}' --aws-sigv4 "$auth" --user "$creds" -X PUT "$bucket_url")
case "$code" in
  200) echo "Создан бакет $SILO_BUCKET" ;;
  409) echo "Бакет $SILO_BUCKET уже есть" ;;
  *) echo "Не удалось создать бакет $SILO_BUCKET: HTTP $code" >&2; exit 1 ;;
esac

# как mcli anonymous set download: чтение объектов без ключа, запись – только с ключом
curl -sf --aws-sigv4 "$auth" --user "$creds" -X PUT "$bucket_url?policy" \
  -H 'Content-Type: application/json' \
  --data-binary "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::$SILO_BUCKET/*\"]}]}"
echo "Публичное чтение $SILO_BUCKET включено"
