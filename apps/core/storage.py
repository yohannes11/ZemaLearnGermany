from whitenoise.storage import CompressedManifestStaticFilesStorage


class StaticStorage(CompressedManifestStaticFilesStorage):
    """Hashed, compressed static files, except the recorded audio.

    The course looks clips up by name in the browser (static/audio/<voice>/<speed>/<id>.mp3), so they
    keep their plain names. They are already compressed and never change, so hashing them would only
    double the size of the collected files.
    """

    manifest_strict = False

    def post_process(self, paths, dry_run=False, **options):
        paths = {name: value for name, value in paths.items() if not name.startswith("audio/")}
        yield from super().post_process(paths, dry_run=dry_run, **options)
