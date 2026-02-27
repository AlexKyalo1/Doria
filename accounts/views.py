from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.serializers import ModelSerializer
from rest_framework.validators import UniqueValidator
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate, login
from django.contrib.auth.hashers import make_password
from .serializers import UserSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_api(request):
    print(request.headers)  # Check if Authorization header arrives
    serializer = UserSerializer(request.user)
    return Response({"user": serializer.data})


# Serializer
class RegisterSerializer(ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )

    username = serializers.CharField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )

    password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "confirm_password")

    def validate(self, data):
        # Check password match
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError({"error": "Passwords do not match"})

        # Validate password strength
        try:
            validate_password(data["password"])
        except ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        return data

    def create(self, validated_data):
        validated_data.pop("confirm_password")

        # Use create_user (automatically hashes password properly)
        user = User.objects.create_user(**validated_data)
        return user


# API View
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

    # Debug: print errors
    print(serializer.errors)  # <-- this will show exactly why DRF rejects
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def login_api(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(request, username=username, password=password)
    if user is not None:
        # Log the user in (session)
        login(request, user)
        serializer = UserSerializer(user)
        return Response({"message": "Login successful", "user": serializer.data})
    else:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

