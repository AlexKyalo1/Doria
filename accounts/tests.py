from django.contrib.auth.models import User
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from utils.hashid import encode_id
from .models import Institution, InstitutionMembership


class InstitutionModelTests(APITestCase):
    def test_creating_institution_sets_owner(self):
        owner = User.objects.create_user(username="owner", password="password123")
        institution = Institution.objects.create(name="Acme", owner=owner)

        self.assertEqual(institution.owner, owner)

    def test_owner_auto_membership_as_admin(self):
        owner = User.objects.create_user(username="owner", password="password123")
        self.client.force_authenticate(user=owner)

        response = self.client.post(
            "/api/accounts/institutions/",
            {"name": "Acme", "description": "Desc"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        institution = Institution.objects.get(name="Acme")
        membership = InstitutionMembership.objects.get(institution=institution, user=owner)
        self.assertEqual(membership.role, "admin")

    def test_duplicate_membership_is_rejected(self):
        owner = User.objects.create_user(username="owner", password="password123")
        member = User.objects.create_user(username="member", password="password123")
        institution = Institution.objects.create(name="Acme", owner=owner)

        InstitutionMembership.objects.create(institution=institution, user=member)

        with self.assertRaises(IntegrityError):
            InstitutionMembership.objects.create(institution=institution, user=member)


class InstitutionApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="password123")
        self.admin = User.objects.create_user(username="admin", password="password123")
        self.member = User.objects.create_user(username="member", password="password123")
        self.outsider = User.objects.create_user(username="outsider", password="password123")

        self.institution = Institution.objects.create(name="Acme", owner=self.owner)
        InstitutionMembership.objects.create(
            institution=self.institution,
            user=self.owner,
            role="admin",
        )
        InstitutionMembership.objects.create(
            institution=self.institution,
            user=self.admin,
            role="admin",
        )

        self.institution_hash = encode_id(self.institution.id)

    def test_non_member_cannot_update_institution(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.patch(
            f"/api/accounts/institutions/{self.institution_hash}/",
            {"name": "Updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_add_member_but_outsider_cannot(self):
        self.client.force_authenticate(user=self.admin)
        add_response = self.client.post(
            f"/api/accounts/institutions/{self.institution_hash}/members/",
            {"user_id": encode_id(self.member.id), "role": "member"},
            format="json",
        )

        self.assertEqual(add_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.outsider)
        remove_response = self.client.delete(
            f"/api/accounts/institutions/{self.institution_hash}/members/{encode_id(self.member.id)}/"
        )

        self.assertEqual(remove_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_cannot_be_removed(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            f"/api/accounts/institutions/{self.institution_hash}/members/{encode_id(self.owner.id)}/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be removed", response.json()["error"])

    def test_invalid_hashids_are_rejected(self):
        self.client.force_authenticate(user=self.owner)

        detail_response = self.client.get("/api/accounts/institutions/invalidhash/")
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

        add_response = self.client.post(
            f"/api/accounts/institutions/{self.institution_hash}/members/",
            {"user_id": "invalidhash", "role": "member"},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_400_BAD_REQUEST)

        remove_response = self.client.delete(
            f"/api/accounts/institutions/{self.institution_hash}/members/invalidhash/"
        )
        self.assertEqual(remove_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ids_in_responses_are_hashids(self):
        self.client.force_authenticate(user=self.owner)

        create_response = self.client.post(
            "/api/accounts/institutions/",
            {"name": "Hash School", "description": "Desc"},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        institution_payload = create_response.json()["institution"]
        self.assertIsInstance(institution_payload["id"], str)
        self.assertIsInstance(institution_payload["owner_id"], str)

        list_response = self.client.get("/api/accounts/institutions/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(list_response.json()["institutions"])

        members_response = self.client.get(
            f"/api/accounts/institutions/{self.institution_hash}/members/list/"
        )
        self.assertEqual(members_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(members_response.json()["institution_id"], str)
        self.assertIsInstance(members_response.json()["members"][0]["user_id"], str)

