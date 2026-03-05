from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer
from rest_framework.validators import UniqueValidator

from utils.hashid import decode_id, encode_id
from .models import Institution, InstitutionMembership
from .serializers import (
    AddInstitutionMemberSerializer,
    AdminUserSerializer,
    InstitutionMembershipSerializer,
    InstitutionSerializer,
    UserSerializer,
)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile_view_api(request):
    user = request.user

    if request.method == "GET":
        serializer = UserSerializer(user)
        return Response({"user": serializer.data})

    serializer = UserSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"user": serializer.data}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_api(request):
    serializer = UserSerializer(request.user)
    return Response({"user": serializer.data})


class RegisterSerializer(ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())],
    )

    username = serializers.CharField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())],
    )

    password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "confirm_password")

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError({"error": "Passwords do not match"})

        try:
            validate_password(data["password"])
        except ValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return data

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        user = User.objects.create_user(**validated_data)
        return user


@api_view(["POST"])
def register_api(request):
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {
                "message": "Registration successful",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def login_api(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        serializer = UserSerializer(user)
        return Response({"message": "Login successful", "user": serializer.data})

    return Response(
        {"error": "Invalid credentials"},
        status=status.HTTP_401_UNAUTHORIZED,
    )


def _get_institution_from_hash(institution_hash):
    institution_id = decode_id(institution_hash)
    if not institution_id:
        return None

    try:
        return Institution.objects.get(id=institution_id)
    except Institution.DoesNotExist:
        return None


def _can_manage_members(user, institution):
    if institution.owner_id == user.id:
        return True

    return InstitutionMembership.objects.filter(
        institution=institution,
        user=user,
        role="admin",
    ).exists()


def _require_site_admin(user):
    return bool(user and user.is_authenticated and user.is_staff)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_users_collection_api(request):
    if not _require_site_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    queryset = User.objects.all().order_by("-date_joined")
    query = request.query_params.get("q", "").strip()
    if query:
        queryset = queryset.filter(username__icontains=query)

    serializer = AdminUserSerializer(queryset, many=True)
    return Response({"users": serializer.data}, status=status.HTTP_200_OK)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_user_detail_api(request, user_id):
    if not _require_site_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    target_id = decode_id(user_id)
    if not target_id:
        return Response({"error": "Invalid user ID"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.get(id=target_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        if target_user.id == request.user.id:
            return Response(
                {"error": "You cannot delete your own account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.delete()
        return Response({"message": "User deleted"}, status=status.HTTP_200_OK)

    serializer = AdminUserSerializer(target_user, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if target_user.id == request.user.id and serializer.validated_data.get("is_staff") is False:
        return Response(
            {"error": "You cannot remove your own staff access"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer.save()
    return Response({"user": serializer.data}, status=status.HTTP_200_OK)


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def institutions_collection_api(request):
    if request.method == "POST":
        serializer = InstitutionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        institution = serializer.save(owner=request.user)

        InstitutionMembership.objects.get_or_create(
            institution=institution,
            user=request.user,
            defaults={"role": "admin"},
        )

        return Response(
            {"institution": InstitutionSerializer(institution).data},
            status=status.HTTP_201_CREATED,
        )

    institutions = request.user.institutions.select_related("owner").all().distinct()
    serializer = InstitutionSerializer(institutions, many=True)
    return Response({"institutions": serializer.data})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def institution_detail_api(request, institution_id):
    institution = _get_institution_from_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = InstitutionSerializer(institution)
        return Response({"institution": serializer.data})

    if institution.owner_id != request.user.id:
        return Response(
            {"error": "Only owner can update"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = InstitutionSerializer(institution, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"institution": serializer.data})

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def institution_members_api(request, institution_id):
    institution = _get_institution_from_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    if not _can_manage_members(request.user, institution):
        return Response(
            {"error": "Only owner or institution admin can add members"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = AddInstitutionMemberSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_id = serializer.validated_data["user_id"]
    role = serializer.validated_data["role"]

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    membership, created = InstitutionMembership.objects.get_or_create(
        institution=institution,
        user=user,
        defaults={"role": role},
    )

    if not created:
        return Response(
            {
                "message": "User already a member",
                "membership": InstitutionMembershipSerializer(membership).data,
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "message": "Member added successfully",
            "membership": InstitutionMembershipSerializer(membership).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def institution_member_detail_api(request, institution_id, user_id):
    institution = _get_institution_from_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    if not _can_manage_members(request.user, institution):
        return Response(
            {"error": "Only owner or institution admin can remove members"},
            status=status.HTTP_403_FORBIDDEN,
        )

    member_user_id = decode_id(user_id)
    if not member_user_id:
        return Response({"error": "Invalid user ID"}, status=status.HTTP_400_BAD_REQUEST)

    if member_user_id == institution.owner_id:
        return Response(
            {"error": "Institution owner cannot be removed"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deleted_count, _ = InstitutionMembership.objects.filter(
        institution=institution,
        user_id=member_user_id,
    ).delete()

    if deleted_count == 0:
        return Response({"error": "Membership not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response({"message": "Member removed"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def institution_members_list_api(request, institution_id):
    institution = _get_institution_from_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    if not InstitutionMembership.objects.filter(
        institution=institution,
        user=request.user,
    ).exists():
        return Response(
            {"error": "Only institution members can view members"},
            status=status.HTTP_403_FORBIDDEN,
        )

    memberships = InstitutionMembership.objects.filter(institution=institution).select_related(
        "user"
    )
    serializer = InstitutionMembershipSerializer(memberships, many=True)

    return Response(
        {
            "institution_id": encode_id(institution.id),
            "members": serializer.data,
        },
        status=status.HTTP_200_OK,
    )
