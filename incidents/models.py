# incidents/models.py
from django.db import models
from security.models import SecurityFacility
from accounts.models import Institution

class Incident(models.Model):
    INCIDENT_TYPES = [
        ('robbery', 'Robbery'),
        ('assault', 'Assault'),
        ('accident', 'Accident'),
        ('missing_person', 'Missing Person'),
        ('murder', 'Murder'),
        ('theft', 'Theft'),
        ('other', 'Other'),
    ]

    ob_number = models.CharField(max_length=50)
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPES)
    description = models.TextField()
    facility = models.ForeignKey(SecurityFacility, on_delete=models.SET_NULL, null=True)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="incidents", null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    occurred_at = models.DateTimeField()
    reported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.incident_type} - {self.ob_number}"

