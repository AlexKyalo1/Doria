# security/models.py
from django.db import models

class SecurityFacility(models.Model):
    FACILITY_TYPES = [
        ('police_station', 'Police Station'),
        ('police_post', 'Police Post'),
        ('dci', 'DCI Office'),
        ('administration', 'Administration Police'),
    ]

    name = models.CharField(max_length=255)
    facility_type = models.CharField(max_length=50, choices=FACILITY_TYPES)
    county = models.CharField(max_length=100)
    sub_county = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.get_facility_type_display()})"
