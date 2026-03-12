from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('incidents', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='incident',
            name='institution',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='incidents',
                to='accounts.institution',
            ),
        ),
    ]
