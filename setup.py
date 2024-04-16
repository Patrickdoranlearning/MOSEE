from setuptools import setup, find_packages

setup(
    name='MOSEE',  # Replace 'your_package_name' with the name of your package
    version='0.1.0',  # Replace '0.1.0' with the version number of your package
    description='Description of your package',
    long_description='Long description of your package',
    author='Your Name',
    author_email='your.email@example.com',
    url='https://github.com/your_username/your_package_name',
    packages=find_packages(),  # Automatically find packages in the 'src' directory
    install_requires=[  # List of dependencies required by your package
        'numpy>=1.0',
        'matplotlib>=3.0',
        # Add other dependencies as needed
    ],
    classifiers=[  # Metadata to classify your package
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
)
