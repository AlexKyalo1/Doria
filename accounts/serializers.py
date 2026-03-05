from django.contrib.auth.models import User
from rest_framework import serializers

from utils.hashid_field import HashIdField
from .models import Institution, InstitutionMembership


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "username",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "username", "is_superuser", "date_joined", "last_login"]


class InstitutionSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    owner_id = HashIdField(read_only=True)

    class Meta:
        model = Institution
        fields = ["id", "name", "description", "owner_id", "created_at"]
        read_only_fields = ["id", "owner_id", "created_at"]


class InstitutionMembershipSerializer(serializers.ModelSerializer):
    user_id = HashIdField(read_only=True)
    username = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = InstitutionMembership
        fields = ["user_id", "username", "role", "joined_at"]
        read_only_fields = ["user_id", "username", "joined_at"]


class AddInstitutionMemberSerializer(serializers.Serializer):
    user_id = HashIdField()
    role = serializers.ChoiceField(
        choices=InstitutionMembership.ROLE_CHOICES,
        required=False,
        default="member",
    )
