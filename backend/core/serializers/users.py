from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from ..models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    is_admin_role = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "display_name", "first_name", "last_name",
            "email", "phone", "role", "is_active", "is_admin_role",
            "last_login", "date_joined",
        ]
        read_only_fields = ["last_login", "date_joined"]


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "role", "is_active", "password",
        ]

    def validate_role(self, value):
        request = self.context.get("request")
        if value == User.Role.ADMIN and request and not request.user.is_admin_role:
            raise serializers.ValidationError(
                "Seul un administrateur peut créer un administrateur."
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    """Inscription publique — crée toujours un compte Vendeur.

    Le rôle n'est jamais choisi par le visiteur : il est forcé à ``VENDOR``.
    L'identifiant de connexion est l'adresse e-mail (normalisée en minuscules),
    ce qui réutilise le système d'authentification par session existant sans en
    créer un second.
    """

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True, validators=[validate_password], style={"input_type": "password"}
    )
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "first_name", "last_name", "email", "phone", "password", "password_confirm",
        ]

    def validate_email(self, value):
        value = value.strip().lower()
        max_len = User._meta.get_field("username").max_length
        if len(value) > max_len:
            raise serializers.ValidationError("Cette adresse e-mail est trop longue.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Un compte existe déjà avec cette adresse e-mail."
            )
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet identifiant.")
        return value

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Les deux mots de passe ne correspondent pas."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        email = validated_data["email"]
        user = User(
            role=User.Role.VENDOR,
            is_active=True,
            username=email,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
