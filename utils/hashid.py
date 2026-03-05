from hashids import Hashids

hashids = Hashids(salt="GIGAM", min_length=8)


def encode_id(integer_id):
    return hashids.encode(integer_id)


def decode_id(hashid):
    decoded = hashids.decode(hashid)
    return decoded[0] if decoded else None
