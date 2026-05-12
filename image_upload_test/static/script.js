async function uploadImage() {
    const fileInput = document.getElementById('imageInput');
    const status = document.getElementById('status');
    const preview = document.getElementById('imagePreview');
    const log = document.getElementById('dataLog');

    if (fileInput.files.length === 0) {
        status.innerText = "Please select a file first!";
        return;
    }

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    status.innerText = "Uploading...";

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            status.innerText = "Success!";
            // Show the image
            preview.src = data.url;
            preview.style.display = 'block';
            // Show the log
            log.innerText = JSON.stringify(data.log, null, 2);
        } else {
            status.innerText = "Error: " + data.error;
        }
    } catch (error) {
        status.innerText = "Upload failed.";
        console.error(error);
    }
}