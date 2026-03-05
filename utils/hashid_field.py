from rest_framework import serializers

from .hashid import decode_id, encode_id


class HashIdField(serializers.Field):
    default_error_messages = {
        "invalid": "Invalid hashid.",
    }

    def to_representation(self, value):
        if value is None:
            return None
        return encode_id(value)

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")

        decoded = decode_id(data)
        if not decoded:
            self.fail("invalid")

        return decoded

