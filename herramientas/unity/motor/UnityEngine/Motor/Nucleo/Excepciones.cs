using System;

namespace UnityEngine
{
    public partial class UnityException : SystemException
    {
        public UnityException() : base("A Unity Runtime error occurred!") { }
        public UnityException(string message) : base(message) { }
        public UnityException(string message, Exception innerException) : base(message, innerException) { }
    }

    public partial class MissingReferenceException : SystemException
    {
        public MissingReferenceException() { }
        public MissingReferenceException(string message) : base(message) { }
        public MissingReferenceException(string message, Exception innerException) : base(message, innerException) { }
    }

    public partial class MissingComponentException : SystemException
    {
        public MissingComponentException() { }
        public MissingComponentException(string message) : base(message) { }
        public MissingComponentException(string message, Exception innerException) : base(message, innerException) { }
    }

    public partial class UnassignedReferenceException : SystemException
    {
        public UnassignedReferenceException() { }
        public UnassignedReferenceException(string message) : base(message) { }
        public UnassignedReferenceException(string message, Exception innerException) : base(message, innerException) { }
    }
}
